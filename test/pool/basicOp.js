const { RedisPool } = require("../..");


const defaultConfig = {
  connectionLimit: 2,
  password: "asdf",
};


const pool = new RedisPool(defaultConfig);
//pool.disableLog();


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



(async function() {
  await testOP();

})().catch(console.error);


