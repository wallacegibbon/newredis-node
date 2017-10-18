const { createConnection, execute } = require("../lib/basic");


function delay(milliseconds) {
  return new Promise((res, _) => setTimeout(res, milliseconds));
}


async function send4ever(conn) {
  while (true) {
    console.log("==Sending command request...");

    var r = await execute(conn, [ "get", "test_string" ]);
    console.log("==Request result:", r);

    await delay(1000);
  }
}

async function test() {
  try {
    const conn = await createConnection(6379, "localhost");
    await send4ever(conn);
  } catch (e) {
    console.error("**Err:", e.message);
  }
}


test().catch(console.error);

