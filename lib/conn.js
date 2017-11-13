const RedisParser = require("redis-parser");
const net = require("net");
const { inspect } = require("util");

const logger = require("lvlog").getLogger("redisconn");

const { ConnectionError } = require("./error");


class RedisConnection {
  /**
   * This Class will create a connection to Redis server, and use redis-parser
   * to parse data the server sent back. It is Promise-based, user do not need
   * to handle any event, or pass any callback to `execute` method.
   *
   * It's highly recommended to use this class with ES8's async function.
   *
   * @param {Object} config - Object like { port: 6379, host: "localhost" }.
   */
  constructor(config) {
    this.config = Object.assign({ port: 6379, host: "localhost" }, config);
    this.queue = [];

    this.initializeParser();
    this.initializeConnection();
  }


  /**
   * Create a TCP connection to the target Redis server. Data come from this
   * connection will be sent to parser.
   */
  initializeConnection() {
    this.connection = net.createConnection(this.config);

    this.connection.on("data", d => this.parser.execute(d));

    this.connection.on("error", e => {
      this.queueHandlerError(new ConnectionError(e.message));
    });
  }


  /**
   * Initialize the parser. Error and FatalError are treated as the same.
   */
  initializeParser() {
    this.parser = new RedisParser({
      returnReply: this.queueHandlerData.bind(this),
      returnFatalError: this.queueHandlerError.bind(this),
      returnError: this.queueHandlerError.bind(this),
    });
  }


  /**
   * If the queue is not empty, get the oldest one and give error back to it.
   */
  queueHandlerError(e) {
    logger.trace(`queueHandlerError called with: ${inspect(e)}`);
    logger.trace(`current queue size: ${this.queue.length}`);

    if (this.queue.length > 0)
      this.queue.shift().rej(e);
  }


  /**
   * If the queue is not empty, get the oldest one and give data back to it.
   */
  queueHandlerData(d) {
    logger.trace(`queueHandlerData called with: ${inspect(d)}`);
    logger.trace(`current queue size: ${this.queue.length}`);

    if (this.queue.length > 0)
      this.queue.shift().res(d);
  }


  /**
   * @param {string[]} commandArr - Array like [ "set", "name", "wallace" ]
   */
  execute(commandArr) {
    return new Promise((res, rej) => {
      this.queue.push({ res, rej });
      this.connection.write(encodeRedisCommand(commandArr));
    });
  }


  /**
   * The package user will need to stop the log output.
   */
  disableLog() {
    logger.setLevel("ERROR");
  }
}



/**
 * The command you send to redis server will always be array element (the "*").
 *
 * @param {string[]} commands - Array like [ "set", "name", "wallace" ]
 * @returns {string} - String like "*3\r\n$3\r\nset\r\n..."
 */
function encodeRedisCommand(commands) {
  const result = [ Buffer.from(`*${commands.length}\r\n`) ];
  var size = result[0].length;

  for (var x of commands) {
    x = x.toString();
    var argBuf = Buffer.from(`\$${x.length}\r\n${x}\r\n`);

    size += argBuf.length;
    result.push(argBuf);
  }

  return Buffer.concat(result, size);
}


module.exports = RedisConnection;

