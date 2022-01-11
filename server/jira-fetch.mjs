import { request } from "undici";
import { parseHTML } from "linkedom";

const requestSearchCache = new Map();
export const searchIssues = async (jql) => {
  // issue fields to reduce the amount of data we need to fetch
  const fields = [
    "key",
    "subtasks",
    "issuelinks",
    "reporter",
    "description",
    "assignee",
    "status",
    "creator",
    "project",
    "issuetype",
    "summary",
    "created",
  ];
  // TODO: share between workers?
  const cachedFetcher = async (retries = 1) => {
    const fetcher = () =>
      request(`https://jira.freewheel.tv/rest/api/2/search`, {
        method: "POST",
        headers: {
          Authorization: process.env.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql,
          startAt: 0,
          maxResults: 100,
          fields,
        }),
        bodyTimeout: 60 * 1000,
      }).then(async (res) => {
        if (res.statusCode >= 400) {
          throw {
            status: res.statusCode,
            message: `Failed (${
              res.statusCode
            }) to fetch JIRA tickets, Query ${jql}, Reason: ${await res.body.text()}`,
          };
        }
        return res.body.json();
      });

    if (!requestSearchCache.has(jql)) {
      requestSearchCache.set(
        jql,
        fetcher().then((res) => {
          return {
            res,
            ts: new Date().getTime(),
          };
        })
      );
    }
    try {
      const { res, ts } = await requestSearchCache.get(jql);
      // timeout after 5 min
      if (new Date().getTime() - ts > 1000 * 60 * 5) {
        requestSearchCache.delete(jql);
        return cachedFetcher(retries);
      }
      return res;
    } catch (err) {
      requestSearchCache.delete(jql);
      if (retries > 0) {
        // try again
        return cachedFetcher(retries - 1);
      } else {
        throw err;
      }
    }
  };

  return cachedFetcher();
};

const userInfoCache = new Map();
export const getUserInfo = async (username) => {
  // TODO: share between workers?
  const cachedFetcher = async (retries = 1) => {
    const fetcher = () =>
      request(
        `https://jira.freewheel.tv/secure/ViewProfile.jspa?name=${username}`,
        {
          method: "GET",
          headers: {
            Authorization: process.env.authorization,
          },
        }
      ).then(async (res) => {
        return res.body.text();
      });

    if (!userInfoCache.has(username)) {
      const p = fetcher().then((res) => {
        const { document } = parseHTML(res);
        const info = Object.fromEntries(
          Array.from(document.querySelectorAll(".item-details li dl")).map(
            (a) =>
              a.textContent
                .replaceAll(/[\n\t]/g, "")
                .replaceAll(/\s+/g, " ")
                .split(":")
                .map((m) => m.trim())
          )
        );

        return {
          res: info,
          ts: new Date().getTime(),
        };
      });
      userInfoCache.set(username, p);
    }
    try {
      const { res } = await userInfoCache.get(username);
      return res;
    } catch (err) {
      console.log(err);
      userInfoCache.delete(username);
      if (retries > 0) {
        // try again
        return cachedFetcher(retries - 1);
      } else {
        throw err;
      }
    }
  };

  return cachedFetcher(username);
};
