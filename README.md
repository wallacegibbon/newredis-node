# A Redis Connection Pool Based On Hiredis



## Introduction

This is a redis connection pool based on [hiredis][1] package. All code are written in the newest JS standard (async/await & promise). Exceptions are handled so you don't need to listen to any event.



## How to use it

First, install it through npm:
```sh
npm install newredis
```

A simple example:

```javascript
const { RedisPool } = require("newredis");
const pool = new RedisPool({ port: 6379, host: "localhost" });

(async function() {
  const conn = await pool.getConnection()

  await conn.execute([ "set", "test_string", "Info from my redis-pool" ]);
  const r = await conn.execute([ "get", "test_string" ]);

  console.log(r);

})().catch(console.error);
```



## Why another redis pool ?

There are already some redis pool implementations available, but most of them(all I saw) are based on [node\_redis][1]. `node_redis` is a good library, but there are 2 things about node\_redis that I don't like:

(The following tests are based on node\_redis@2.8.0)

1. The callback do not get error when the connection is down. You can try the following script:

```javascript
const redis = require("redis");
const conn = redis.createClient(6379, "localhost");
conn.on("error", e => console.error("***Conn err:", e));

setInterval(() => {
  console.log("==Sending command request...");
  conn.get("test_string", (e, r) => {
    if (e) console.error("**command get error:", e);
    else console.log("result:", r);
  });
}, 1000);
```

Start that script, you will see outputs like this:

```
==Sending command request...
result: Info from my redis-pool
==Sending command request...
result: Info from my redis-pool
...
```

Then you shutdown the redis server, this is what you will see:

```
==Sending command request...
***Conn err: { Error: Redis connection to localhost:6379 failed - connect ECONNREFUSED 127.0.0.1:6379
==Sending command request...
***Conn err: { Error: Redis connection to localhost:6379 failed - connect ECONNREFUSED 127.0.0.1:6379
...
```

You will never see string like "\*\*command get error" because the callback of `conn.get` has never been not called.


2. node\_redis wraps every redis command. I don't think it's right. Writing `conn.execute([ "get", "blah" ])` is more flexible then writing `conn.get("blah")`. The previous one is easier to integrate with other programs.

For more complex method like `hmset`, writing `conn.hmset({ a: 1, b: 2 })` is cool, but you can also solve it by writing a simple helper function like this:

```javascript
function tohmset(obj) {
  return [ "hmset" ].concat([].concat(...Object.entries(obj)));
}
```

then `conn.execute(tohmset({ a: 1, b: 2 }))`. Convenient, too. And you don't need to remember those rules for a certain library.


That's why I implement another redis pool.



[1]: https://github.com/redis/hiredis-node
[2]: https://github.com/NodeRedis/node_redis

