import datascript from "datascript";
import lodash from "lodash";

import { log } from "./log.mjs";
import { searchIssues, getUserInfo } from "./jira-fetch.mjs";

const schema = {
  // user
  ":user/name": {
    ":db/cardinality": ":db.cardinality/one",
    ":db/unique": ":db.unique/identity",
  },
  ":user/avatarUrls": {},
  ":user/displayName": {
    ":db/cardinality": ":db.cardinality/one",
  },
  ":user/active": {
    ":db/cardinality": ":db.cardinality/one",
  },
  ":user/timeZone": {
    ":db/cardinality": ":db.cardinality/one",
  },
  // issue
  ":issue/key": {
    ":db/cardinality": ":db.cardinality/one",
    ":db/unique": ":db.unique/identity",
  },
  ":issue/creator": {
    ":db/cardinality": ":db.cardinality/one",
    ":db/valueType": ":db.type/ref",
  },
  ":issue/reporter": {
    ":db/cardinality": ":db.cardinality/one",
    ":db/valueType": ":db.type/ref",
  },
  ":issue/assignee": {
    ":db/cardinality": ":db.cardinality/one",
    ":db/valueType": ":db.type/ref",
  },
  ":issue/status": {},
  ":issue/type": {},
  ":issue/mentioned": {
    ":db/cardinality": ":db.cardinality/many",
    ":db/valueType": ":db.type/ref",
  },
};

const createEmptyConn = () => datascript.create_conn(schema);

// e.g, [~pengxiao] => pengxiao
function getMentionedUsersFromText(text) {
  const regex = /\[~(\w+)\]/g;
  const matches = Array.from((text ?? "").matchAll(regex));
  return matches ? matches.map((m) => m[1]) : [];
}

function jiraUserToDatom(user) {
  return {
    ":user/name": user.name,
    ":user/avatarUrl": user.avatarUrls,
    ":user/displayName": user.displayName,
    ":user/active": user.active,
    ":user/timeZone": user.timeZone,
  };
}

function jiraUserToRef(user) {
  return [":user/name", user?.name];
}

function issueToDatoms(issue) {
  const mentioned = getMentionedUsersFromText(issue.fields.description).map(
    (name) => {
      return {
        ":user/name": name,
      };
    }
  );
  const users = [
    ...mentioned,
    ...[issue.fields.assignee, issue.fields.creator, issue.fields.reporter]
      .filter(Boolean)
      .map(jiraUserToDatom),
  ];
  return [
    ...users,
    {
      ":issue/key": issue.key,
      ":issue/type": issue.fields.issuetype.name,
      ":issue/description": issue.fields.description ?? "",
      ":issue/subtasks": issue.fields.subtasks,
      ":issue/summary": issue.fields.summary,
      ":issue/created": issue.fields.created,
      ":issue/project": issue.fields.project.key,
    },
    issue.fields.assignee && {
      ":issue/key": issue.key,
      ":issue/assignee": jiraUserToRef(issue.fields.assignee),
    },
    issue.fields.creator && {
      ":issue/key": issue.key,
      ":issue/creator": jiraUserToRef(issue.fields.creator),
    },
    issue.fields.reporter && {
      ":issue/key": issue.key,
      ":issue/reporter": jiraUserToRef(issue.fields.reporter),
    },
    ...mentioned.map((p) => {
      return {
        ":issue/key": issue.key,
        ":issue/mentioned": p,
      };
    }),
  ].filter(Boolean);
}

function queryUserDirectLinks(conn, username, parent, pullIssues = true) {
  const start = performance.now();
  const result = datascript
    .q(
      `
  [:find ?n1 ?n2 ${
    pullIssues ? '(pull ?i [":issue/key" ":issue/summary"])' : ""
  }
   :where 
        [?u1 ":user/name" ?n1]
        [?u2 ":user/name" ?n2]
        (or [(= "${username}" ?n1)]
            [(= "${username}" ?n2)])
        [?i ":issue/project" ?proj]
        [(contains? #{"FW" "FWS" "UX" "EN"} ?proj)]
        [?i ":issue/assignee" ?u1]
        [(!= ?u1 ?u2)]
        (or [?i ":issue/creator"  ?u2]
            [?i ":issue/reporter" ?u2]
            [?i ":issue/mentioned" ?u2])]
    `,
      datascript.db(conn)
    )
    .map(([n1, n2, i]) => {
      return { source: n2, target: n1, ticket: i };
    });

  log.info(
    `datascript.q(${parent}:${username}) = ${result.length} takes ${(
      performance.now() - start
    ).toFixed(2)}ms`
  );
  return result;
}

function queryUserLinksByUser(conn, username, depth) {
  if (depth === 0) {
    return [];
  }
  const seen = new Set();
  function impl(currentUser, depth, parent) {
    if (depth === 0) {
      return [];
    }
    if (seen.has(currentUser)) {
      return [];
    }
    seen.add(currentUser);
    const links = queryUserDirectLinks(conn, currentUser, parent);
    return [
      ...links,
      ...links.flatMap((link) =>
        impl(link.source, depth - 1, `${parent}:${currentUser}`)
      ),
      ...links.flatMap((link) =>
        impl(link.target, depth - 1, `${parent}:${currentUser}`)
      ),
    ];
  }
  const res = impl(username, depth, "root");
  return res;
}

async function getUsers(conn) {
  const users = datascript
    .q(
      `
    [:find (pull ?u [*])
     :where 
      [?u ":user/name"]]
      `,
      datascript.db(conn)
    )
    .flat();

  return Promise.all(
    users.map(async (user) => {
      const additionInfo = await getUserInfo(user[":user/name"]);
      return {
        ...user,
        ...additionInfo,
      };
    })
  );
}

let fetchCounter = 0;
const pendingFetch = new Set();
const populatedSeeds = new Set();

const populateDBByUser = async (conn, seed, seen, depth, parent) => {
  if (seen.has(seed) || depth === 0) {
    return [];
  }
  seen.add(seed);
  if (!populatedSeeds.has(seed)) {
    const jql = `(assignee = "${seed}" OR creator = "${seed}" OR reporter = "${seed}") AND updated > startOfDay("-30d") order by updated DESC`;
    const start = performance.now();
    const currentSearch = { id: fetchCounter++, seed };
    pendingFetch.add(currentSearch);
    log.info(`searching (${seed})/(${pendingFetch.size}) ...`);
    const response = await searchIssues(jql);
    pendingFetch.delete(currentSearch);
    log.info(
      `  search (${seed}) used ${(performance.now() - start).toFixed(2)}ms (${
        pendingFetch.size
      })`
    );
    if (response.issues) {
      const datoms = response.issues.flatMap(issueToDatoms);
      datascript.transact(conn, datoms, "populate db from " + seed);
      log.info(
        `populating(${seed}) used ${(performance.now() - start).toFixed(2)}ms`
      );
      populatedSeeds.add(seed);
    }
  }
  const userLinks = queryUserDirectLinks(conn, seed, parent, false);
  const res = await Promise.all(
    // This will be slower and slower after getting deep
    userLinks.map(async (link) => {
      const childLinks = (
        await Promise.all([
          populateDBByUser(
            conn,
            link.source,
            seen,
            depth - 1,
            `${parent}:${seed}`
          ),
          populateDBByUser(
            conn,
            link.target,
            seen,
            depth - 1,
            `${parent}:${seed}`
          ),
        ])
      ).flat();
      return [link, ...childLinks];
    })
  );

  return res.flat();
};

function toCORSImageUrl(url) {
  const urlObj = new URL(url);
  return `/api/useravatar?` + urlObj.searchParams.toString();
}

function toGraphinData(focus, users, links) {
  if (users?.length === 0 || links?.length === 0) {
    return { nodes: [], edges: [] };
  }
  const start = performance.now();

  const primaryUsers = users
    .filter((user) => {
      return links.some((edge) => {
        const [source, target] = [edge.source, edge.target];
        return (
          [source, target].includes(user[":user/name"]) &&
          [source, target].includes(focus)
        );
      });
    })
    .map((u) => u[":user/name"]);

  // Raw edges may have duplicates
  let parsedLinks = lodash.uniqBy(links, (link) => {
    return [link.source, link.target, link.ticket[":issue/key"]].join("|");
  });

  const groupedLinks = Object.entries(
    lodash.groupBy(parsedLinks, (link) => [link.source, link.target].join("|"))
  ).map((pair) => pair[1]);

  let edges = groupedLinks.map((_edges) => {
    const sample = _edges[0];
    const primaryLink = sample.source === focus || sample.target === focus;

    const sourceUser = users.find((u) => u[":user/name"] === sample.source);
    const targetUser = users.find((u) => u[":user/name"] === sample.target);

    let color = primaryLink ? "rgba(100,100,100, 0.9)" : "rgba(220, 220, 220)";

    if (
      sourceUser.Office !== targetUser.Office &&
      targetUser.Office &&
      sourceUser.Office
    ) {
      color = `rgb(220, 0, 0)`;
    }

    /**
     * @type {import('@antv/graphin').IUserEdge}
     */
    const edge = {
      source: sample.source,
      target: sample.target,
      edges: _edges,
      style: {
        keyshape: {
          stroke: color,
          lineWidth: Math.min(_edges.length, 8),
          shadowBlur: primaryLink ? 10 : 0,
          shadowColor: primaryLink ? "rgba(100,100,100, 0.9)" : "",
        },
      },
    };
    return edge;
  });

  const nodes = users
    .map((user) => {
      const isFocus = user[":user/name"] === focus;
      const isPrimary = primaryUsers.includes(user[":user/name"]);
      const avatar = user[":user/avatarUrl"]?.["48x48"];
      const imgUrl = avatar && toCORSImageUrl(avatar);
      // Find number of connections for this user
      const connections = edges.reduce((acc, edge) => {
        if (
          edge.source === user[":user/name"] ||
          edge.target === user[":user/name"]
        ) {
          return acc + 1;
        }
        return acc;
      }, 0);
      const size = isFocus ? 64 : Math.max(32, Math.min(connections * 10, 64));
      /**
       * @type {import('@antv/graphin').IUserNode}
       */
      const node = {
        ...user,
        id: user[":user/name"],
        label: user[":user/displayName"],
        type: "graphin-circle",
        avatar: imgUrl,
        style: {
          label: {
            value: user[":user/displayName"] ?? user[":user/name"],
          },
          keyshape: {
            size,
            shadowBlur: isPrimary ? 16 : 0,
            shadowColor: isPrimary ? "rgba(0,0,0,1)" : "",
          },
          icon: {
            type: "image",
            size: size - 2,
            value: imgUrl,
            clip: {
              r: (size - 2) / 2,
            },
          },
        },
      };

      return node;
    })
    .filter(({ id }) => {
      return edges.some((edge) => edge.source === id || edge.target === id);
    });

  log.info(
    `toGraphinData(${focus}) used ${(performance.now() - start).toFixed(2)}ms`
  );
  return { nodes, edges: edges };
}

// TODO: reset me when timeout
const conn = createEmptyConn();

export async function getGraphinData(seed) {
  try {
    await populateDBByUser(conn, seed, new Set(), 2, "root");
    const links = queryUserLinksByUser(conn, seed, 2);
    const users = await getUsers(conn);
    log.info(
      `Total entities: ` +
        datascript.datoms(datascript.db(conn), ":eavt").length
    );
    return toGraphinData(seed, users, links);
  } catch (err) {
    log.info(err);
    return { error: err };
  }
}
