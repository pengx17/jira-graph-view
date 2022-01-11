import datascript from "datascript";
import * as React from "react";

const DBConnContext = React.createContext(null);

function shallowEqual(objA: any, objB: any) {
  if (objA === objB) {
    return true;
  }

  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  const bHasOwnProperty = Object.prototype.hasOwnProperty.bind(objB);
  for (let i = 0; i < keysA.length; i++) {
    if (!bHasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
      return false;
    }
  }

  return true;
}

function useCompareMemo<T>(value: T) {
  const [state, setState] = React.useState(value);
  React.useEffect(() => {
    if (!shallowEqual(value, state)) {
      setState(state);
    }
  }, [state, value]);
  return state;
}

interface Report {
  tx_data: { a: string }[];
}

function useExecute(exec: (report?: Report) => void) {
  const conn = React.useContext(DBConnContext);
  React.useEffect(() => {
    exec();
    datascript.listen(conn, exec);
    return () => datascript.unlisten(conn);
  }, [exec, conn]);
}

export function useQuery(query: string, params?: any, rules?: string) {
  const conn = React.useContext(DBConnContext);
  const [result, setResult] = React.useState([]);
  const memorizedParams = useCompareMemo(params);
  const execQuery = React.useCallback(
    (report?: Report) => {
      let queryResult = null;
      if (query) {
        const qArgs = [query, datascript.db(conn)];
        if (memorizedParams) {
          qArgs.push(memorizedParams);
        }
        if (rules) {
          qArgs.push(rules);
        }
        queryResult = datascript.q(...qArgs);
      }
      setResult((res) => queryResult ?? res);
    },
    [query, conn, memorizedParams, rules]
  );

  useExecute(execQuery);

  return result;
}

export function usePull(pull: string, entityIds?: any[]) {
  const conn = React.useContext(DBConnContext);
  const [result, setResult] = React.useState([]);
  const memoizedEntityIds = useCompareMemo(entityIds);
  const execQuery = React.useCallback(() => {
    if (pull) {
      setResult(
        datascript.pull_many(datascript.db(conn), pull, memoizedEntityIds)
      );
    }
  }, [pull, conn, memoizedEntityIds]);

  useExecute(execQuery);
  return result;
}

export function useDBConn(dbConn: (conn: any) => any) {
  const conn = React.useContext(DBConnContext);
  const [result, setResult] = React.useState([]);
  const execQuery = React.useCallback(() => {
    if (dbConn) {
      setResult(dbConn(conn));
    }
  }, [conn, dbConn]);

  useExecute(execQuery);
  return result;
}

export function useTransact() {
  const conn = React.useContext(DBConnContext);
  return React.useCallback(
    (data, txMsg?: string) => {
      return datascript.transact(conn, data, txMsg);
    },
    [conn]
  );
}

export function useConnection() {
  return React.useContext(DBConnContext);
}
