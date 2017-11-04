const EventEmitter = require("events");


class RedisConnectionEventEmitter extends EventEmitter {}

class RedisPoolEventEmitter extends EventEmitter {}


module.exports = {
  RedisConnectionEventEmitter,
  RedisPoolEventEmitter,
};
