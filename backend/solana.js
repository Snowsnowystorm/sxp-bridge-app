const { Connection, PublicKey } = require("@solana/web3.js");

const connection = new Connection(process.env.SOL_RPC);

async function listenSOL(address, saveTx) {
  const pubkey = new PublicKey(address);

  connection.onLogs(pubkey, async (log) => {
    console.log("SOL deposit detected");

    await saveTx({
      user: address,
      amount: 0, // parse real amount later
      type: "deposit",
      chain: "SOL",
      status: "completed",
      hash: log.signature
    });
  });
}

module.exports = { listenSOL };
