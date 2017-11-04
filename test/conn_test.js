const RedisConnection = require("../lib/conn");


async function test() {
  try {
    console.log("Trying to create connection to redis server...");
    const conn = new RedisConnection();

    console.log("Trying to send request to redis server...");
    await conn.execute([ "set", "test_string", "hello" ]);

    //console.log("==Sending ERROR command request...");
    //await conn.execute([ "ssget", "test_string" ]);
    //await conn.execute([ "hget", "test_string", "a" ]);

    await send4ever(conn);
  } catch (e) {
    console.error("**Err:", e);
  }
}


async function send4ever(conn) {
  while (true) {
    console.log("==Sending command request...");
    var r = await conn.execute([ "get", "test_string" ]);
    console.log("==Request result:", r);

    await delay(1000);
  }
}


function delay(milliseconds) {
  return new Promise((res, _) => setTimeout(res, milliseconds));
}


test().catch(console.error);

