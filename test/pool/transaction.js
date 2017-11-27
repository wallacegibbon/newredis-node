const { RedisConnectionPool } = require("../..");


const defaultConfig = {
  connectionLimit: 2,
  password: "asdf",
};


const pool = new RedisConnectionPool(defaultConfig);


async function testOP() {
  const conn = await pool.getConnection();

  var r;
  try {
    r = await conn.transaction([
      [ "set", "mycounter", 1 ],
      [ "incr", "mycounter" ],
      [ "blah" ],
      [ "incr", "mycounter" ],
      [ "incr", "mycounter" ],
    ]);
    console.log("R:", r);
  } catch (e) {
    console.error("E:", e);
  }

  try {
    r = await conn.transaction([
      [ "set", "mycounter", 1 ],
      [ "incr", "mycounter" ],
      [ "incr", "mycounter" ],
      [ "incr", "mycounter" ],
    ]);
    console.log("R:", r);
  } catch (e) {
    console.error("E:", e);
  }
  conn.release();
}



(async function() {
  await testOP();

})().catch(console.error);


