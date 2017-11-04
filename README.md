# A Redis Connection Pool Implementation


## Introduction

This is a redis connection pool based on [redis-parser][1]. All code are written in the newest JS standard (async/await & promise). Exceptions are handled so you don't need to listen to any event.



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

There are already some redis pool implementations available, but most of them(all I saw) are based on [node\_redis][1]. `node_redis` is a good library, but there are 2 things about node\_redis that I can't get used to.

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

This is odd, and it's also why you can't make a perfect Promise wrapper for node\_redis.

In my opinion, if the connection got error when `conn.get` is called, it should trigger the callback of `conn.get`, and give err as argument to the callback of `conn.get`. And I made newredis-node works in that way.



2. node\_redis wraps every redis command. I don't think it's right. Writing `conn.execute([ "get", "blah" ])` is more flexible then writing `conn.get("blah")`. The previous one is easier to integrate with other programs.

For more complex method like `hmset`, writing `conn.hmset(key, { a: 1, b: 2 })` is cool, but you can also solve it by writing a simple helper function like this:

```javascript
function tohmset(key, obj) {
  return [ "hmset", key ].concat([].concat(...Object.entries(obj)));
}
```

then `conn.execute(tohmset(key, { a: 1, b: 2 }))`. Convenient, too. And you don't need to remember those rules for a certain library.

If you think the wrapper is important, you should do it in upper level, like what [dbexecutors][3] does.


That's why I implement another redis pool.


[1]: https://www.npmjs.com/package/redis-parser
[2]: https://www.npmjs.com/package/redis
[3]: https://www.npmjs.com/package/dbexecutors

