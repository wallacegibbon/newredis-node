const { RedisConnection } = require("../..");


async function test() {
  try {
    console.log("Trying to create connection to redis server...");
    const conn = new RedisConnection({ password: "asdf" });
    //const conn = new RedisConnection({ password: "111" });
    //conn.disableLog();
    //conn.disableLogColor();

    await conn.initialize();

    console.log("==Trying to set a key...");
    await conn.execute([ "set", "test_string", "hello" ]);

    await send4ever(conn);
  } catch (e) {
    console.error("**Err:", e);
  }
}


async function send4ever(conn) {
  while (true) {
    console.log("==Trying to get a key...");
    var r = await conn.execute([ "get", "test_string" ]);
    console.log("==Response:", r);

    await delay(2000);
  }
}


function delay(milliseconds) {
  return new Promise((res, _) => setTimeout(res, milliseconds));
}


(async function() {
  await test();

})().catch(console.error);

