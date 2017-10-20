const hiredis = require("hiredis");


/**
 * A Promise version createConnection to create TCP connection to redis server.
 * This is based on createConnectionCb.
 */
function createConnection(port, host) {
  return new Promise((res, rej) => {
    createConnectionCb(port, host, (e, conn) => e ? rej(e) : res(conn));
  });
}


/**
 * A Promise version execute, it sends redis commands to redis server and get
 * result throught the tcp connection.
 */
function execute(conn, commandArray) {
  return new Promise((res, rej) => {
    executeCb(conn, commandArray, (e, r) => e ? rej(e) : res(r));
  });
}


/**
 * A simple wrapper for hiredis.createConnection, the "error" event is handled,
 * so that `event` is transformed into `callback` (make it easy to Promise)
 */
function createConnectionCb(port, host, callback) {
  const conn = hiredis.createConnection(port, host);

  conn.once("error", callback);
  conn.once("connect", () => callback(null, conn));
}


/**
 * A simple wrapper for hiredis's `connection.write` method. This function will
 * be called again and again, so there are some special manipulations.
 *
 * You can't just write `conn.once("error", ...)` and `conn.once("reply", ...)`
 * like what you did in `createConnectionCb`, because there will be only one
 * event got triggered. The listener of the other event will keep increasing,
 * which will lead to MaxListenersExceededWarning.
 *
 * You need to `removeListener("error", ...)` when "reply" is triggered.
 */
function executeCb(conn, commandArray, callback) {
  if (conn.destroyed)
    callback(new Error("Socket Destroyed"));

  conn.write.apply(conn, commandArray);

  conn.once("error", callback);

  const f = r => conn.removeListener("error", callback) && callback(null, r);
  conn.once("reply", f);
}


module.exports = {
  createConnection,
  execute,
};

