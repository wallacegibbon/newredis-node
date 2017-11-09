const { RedisPool } = require("../");


const defaultConfig = {
  connectionLimit: 2,
  password: "asdf",
};


const pool = new RedisPool(defaultConfig);
//pool.disableLog();

async function testConnectionLimit() {
  //setInterval(() => console.log("process is not blocked."), 1000);

  process.stdout.write("Trying to get a connection from pool... ");
  const c1 = await pool.getConnection();
  console.log("Got.");

  var r = await c1.execute([ "get", "test_string" ]);
  console.log("get result:", r);

  setTimeout(() => c1.release(), 2000);


  process.stdout.write("Trying to get a connection from pool... ");
  const c2 = await pool.getConnection();
  console.log("Got.");

  r = await c2.execute([ "get", "test_string" ]);
  console.log("get result:", r);


  process.stdout.write("Trying to get a connection from pool... ");
  const c3 = await pool.getConnection();
  console.log("Got.");

  r = await c3.execute([ "get", "test_string" ]);
  console.log("get result:", r);
}


function printTitle(str) {
  console.log(str.padEnd(79, "="));
}


async function testOP() {
  const conn = await pool.getConnection();

  printTitle("Testing REDIS set");
  await conn.execute([ "set", "test_string", "Info from my redis-pool" ]);

  printTitle("Testing redis get");
  var r = await conn.execute([ "get", "test_string" ]);
  console.log("get result:", r);

  printTitle("Testing redis hmset");
  await conn.execute([ "hmset", "test_hash", "a", 1, "b", 2, "c", 3 ]);

  printTitle("Testing redis hmget");
  r = await conn.execute([ "hmget", "test_hash", "a", "b", "c" ]);
  console.log("hmget result:", r);

  printTitle("Testing redis hgetall");
  r = await conn.execute([ "hgetall", "test_hash" ]);
  console.log("hmget result:", r);

  console.log("Release connection.");
  conn.release();
}


async function delay(milliseconds) {
  return new Promise((res, _) => setTimeout(res, milliseconds));
}


async function testErrOP() {
  while (true) {
    try {
      console.log("Trying to get redis connection from pool".padEnd(78, "."));
      var conn = await pool.getConnection();

      var r = await conn.execute([ "get", "test_string" ]);
      console.log("r:", r);

      printTitle("Testing non-exist REDIS command");
      r = await conn.execute([ "aaget", "test_string" ]);
      console.log("r:", r);

      conn.release()

    } catch (e) {
      console.log("**Err:", e.message);
    } finally {
      conn.release();
    }

    await delay(2000);
  }

}


async function testServerError() {
  while (true) {
    try {
      console.log("Trying to get redis connection from pool".padEnd(78, "."));
      var conn = await pool.getConnection();

      var r = await conn.execute([ "get", "test_string" ]);
      console.log("r:", r);

    } catch (e) {
      console.error("**Err:", e);
    } finally {
      conn.release();
    }

    await delay(2000);
  }
}


(async function() {
  //await testConnectionLimit();
  //await testOP();
  //testErrOP();
  testServerError();

})().catch(console.error);


