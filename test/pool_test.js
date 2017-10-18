const RedisPool = require("../lib/pool");


const defaultConfig = {
  connectionLimit: 2,
  host: "localhost",
  port: 6379,
};


const pool = new RedisPool(defaultConfig);


async function testConnectionLimit() {
  //setInterval(() => console.log("process is not blocked."), 1000);

  process.stdout.write("Trying to get a connection from pool... ");
  const c1 = await pool.getConnection();
  console.log("Got.");

  setTimeout(() => c1.release(), 2000);

  process.stdout.write("Trying to get a connection from pool... ");
  const c2 = await pool.getConnection();
  console.log("Got.");

  process.stdout.write("Trying to get a connection from pool... ");
  const c3 = await pool.getConnection();
  console.log("Got.");
}


function printTitle(str) {
  console.log(str.padEnd(79, "="));
}


async function testOP() {
  const conn = await pool.getConnection()

  printTitle("TestING REDIS set");
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


async function testServerError() {
  try {
    console.log("Trying to get redis connection from pool".padEnd(78, "."));
    var conn = await pool.getConnection();

    var r = await conn.execute([ "get", "test_string" ]);
    console.log("r:", r);

    conn.release();

  } catch (e) {
    console.error("Caught error:", e);
  }

  await delay(2000);
  testServerError();
}


(async function() {
  //await testConnectionLimit();
  //await testOP();

  testServerError();

})().catch(console.error);


