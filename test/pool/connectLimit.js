const { RedisPool } = require("../..");


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




(async function() {
  await testConnectionLimit();

})().catch(console.error);


