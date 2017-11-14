# A Modern Redis Client


## Introduction

This is a pure Javascript based redis client(including a connection pool implementation). All code are written in the newest JS standard (async/await & Promise). All related exceptions and events are handled so you can write you code as easy as possible.


## Usage

There are two class exported by this package: `RedisConnection` and `RedisPool`. I will suggest using `RedisPool` only, because it contains broken connection repairing, which is important in production environment. Besides, the API is pretty simple.

First, install it through npm:
```sh
npm install newredis
```

Then import the library and create a client like this:

```js
const { RedisPool } = require("newredis");
const pool = new RedisPool({ port: 6379, host: "localhost", password: "asdf" });
```

If you are using the default host(localhost) and default port(6379), you can simply write:
```js
const pool = new RedisPool({ password: "asdf" });
```

If the `requirepass` in redis configuration is not enabled, you can even write:
```js
const pool = new RedisPool();
```

Now you can use it in Promise way:
```js
pool.getConnection()
.then(conn => {
  return conn.execute([ "get", "hello" ]).then(r => [ conn, r ]);
})
.then(([ conn, r ]) => {
  conn.release();
  console.log("R:", r);
})
.catch(e => {
  console.error("E:", e);
});
```

Or in async/await way:
```js
async function testConn() {
  const conn = await pool.getConnection();

  const r = await conn.execute([ "get", "hello" ]);
  console.log("R:", r);

  conn.release();
}

testConn()
.catch(e => console.error("E:", e));
```


If you really want to use `RedisConnection` instead of `RedisPool`, there are some examples in test directory.


