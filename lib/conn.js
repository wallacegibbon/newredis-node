const RedisParser = require("redis-parser");
const net = require("net");
const { Logger } = require("colourlogger");

const { ConnectionError } = require("./error");


class RedisConnection extends Logger {
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
    super("RedisConnection");
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
      returnFatalError: this.queueHandlerError.bind(this),
      returnError: this.queueHandlerError.bind(this),
      returnReply: this.queueHandlerData.bind(this),
    });
  }


  /**
   * If the queue is not empty, get the oldest one and give error back to it.
   */
  queueHandlerError(e) {
    this.trace(`Current function queue size: ${this.queue.length}`);
    this.trace(`Calling queueHandlerError with: ${e}`);

    if (this.queue.length > 0)
      this.queue.shift().rej(e);
  }


  /**
   * If the queue is not empty, get the oldest one and give data back to it.
   */
  queueHandlerData(d) {
    this.trace(`Current function queue size: ${this.queue.length}`);
    this.trace(`Calling queueHandlerData with: ${d}`);

    if (this.queue.length > 0)
      this.queue.shift().res(d);
  }


  /**
   * This is just a wrapper for this.executeCmd, but will try to auth when
   * executeCmd failed.
   *
   * @param {string[]} commandArr - Array like [ "set", "name", "wallace" ]
   */
  async execute(commandArr) {
    this.info("Trying to execute redis command:" + commandArr);
    try {
      return await this.executeCmd(commandArr);
    } catch (e) {
      if (e.message.indexOf("NOAUTH") !== -1)
        return await this.authExecuteCmd(commandArr);
      else
        throw e;
    }
  }


  /**
   * If password is configured, send auth command, then send the query command.
   * If password not found, send command directly.
   */
  async authExecuteCmd(commandArr) {
    if (this.config.password) {
      await this.executeCmd([ "auth", this.config.password ]);
      return await this.executeCmd(commandArr);
    } else {
      throw new Error("Redis password is not configured");
    }
  }


  /**
   * This is the most fundamental method for Redis query.
   */
  executeCmd(commandArr) {
    this.debug("Sending redis command to server:" + commandArr);
    return new Promise((res, rej) => {
      this.queue.push({ res, rej });
      this.connection.write(encodeRedisCommand(commandArr));
    });
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

