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
 * A Promise version execute, it sends redis commands to redis server, then
 * receive result from the server.
 */
function execute(conn, commandArray) {
  return new Promise((res, rej) => {
    executeCb(conn, commandArray, (e, r) => e ? rej(e) : res(r));
  });
}


/**
 * A simple wrapper for hiredis.createConnection, the "error" event is handled,
 * so that `event` is now `callback` (then it can be Promise)
 */
function createConnectionCb(port, host, callback) {
  const conn = hiredis.createConnection(port, host);

  conn.once("connect", () => callback(null, conn));
  conn.once("error", e => callback(e));
}


/**
 * A simple wrapper for hiredis's `connection.write` method.
 */
function executeCb(conn, commandArray, callback) {
  if (conn.destroyed)
    callback(new Error("Socket Destroyed"));

  conn.write.apply(conn, commandArray);

  conn.once("reply", r => callback(null, r));
  conn.once("error", e => callback(e));
}


module.exports = {
  createConnection,
  execute,
};

