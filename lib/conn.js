const RedisParser = require("redis-parser");
const net = require("net");

const { RedisConnectionEventEmitter } = require("./emitter");
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
    this.emitter = new RedisConnectionEventEmitter();

    this.initializeParser();
    this.initializeConnection();
  }


  /**
   * Create a TCP connection to the target Redis server. Data come from this
   * connection will be sent to parser.
   */
  initializeConnection() {
    this.connection = net.createConnection(this.config);

    this.connection.on("error", e => {
      this.emitter.emit("ev", { e: new ConnectionError(e.message) })
    });
    this.connection.on("data", d => this.parser.execute(d));
  }


  /**
   * Initialize the parser. Error and FatalError are treated as the same.
   */
  initializeParser() {
    this.parser = new RedisParser({
      returnFatalError: e => this.emitter.emit("ev", { e }),
      returnError: e => this.emitter.emit("ev", { e }),
      returnReply: d => this.emitter.emit("ev", { d }),
    });
  }


  /**
   * @param {string[]} commandArr - Array like [ "set", "name", "wallace" ]
   */
  execute(commandArr) {
    return new Promise((res, rej) => {
      this.emitter.once("ev", r => r.e ? rej(r.e) : res(r.d));
      this.connection.write(encodeRedisCommand(commandArr));
    });
  }
}



/**
 * The command you send to redis server will always be array element (the "*").
 *
 * @param {string[]} commandArr - Array like [ "set", "name", "wallace" ]
 * @returns {string} - String like "*3\r\n$3\r\nset\r\n..."
 */
function encodeRedisCommand(commandArray) {
  const result = [ Buffer.from(`*${commandArray.length}\r\n`) ];
  var size = result[0].length;

  for (var x of commandArray) {
    var argBuf = Buffer.from(`\$${x.toString().length}\r\n${x}\r\n`);

    size += argBuf.length;
    result.push(argBuf);
  }

  return Buffer.concat(result, size);
}


module.exports = RedisConnection;

