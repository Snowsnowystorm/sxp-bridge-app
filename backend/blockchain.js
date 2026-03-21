const { ethers } = require("ethers");

// RPC URLs (use Alchemy / Infura)
const ETH_RPC = process.env.ETH_RPC;
const BNB_RPC = process.env.BNB_RPC;

const ethProvider = new ethers.JsonRpcProvider(ETH_RPC);
const bnbProvider = new ethers.JsonRpcProvider(BNB_RPC);

// SXP contract addresses
const SXP_ETH = process.env.SXP_ETH;
const SXP_BNB = process.env.SXP_BNB;

// ERC20 ABI (minimal)
const ABI = [
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

function listenETHDeposits(saveTx) {
  const contract = new ethers.Contract(SXP_ETH, ABI, ethProvider);

  contract.on("Transfer", async (from, to, amount, event) => {
    console.log("ETH Deposit detected:", to);

    await waitConfirmations(ethProvider, event.log.transactionHash);

    await saveTx({
      user: to.toLowerCase(),
      amount: ethers.formatUnits(amount, 18),
      type: "deposit",
      chain: "ETH",
      status: "completed",
      hash: event.log.transactionHash
    });
  });
}

function listenBNBDeposits(saveTx) {
  const contract = new ethers.Contract(SXP_BNB, ABI, bnbProvider);

  contract.on("Transfer", async (from, to, amount, event) => {
    console.log("BNB Deposit detected:", to);

    await waitConfirmations(bnbProvider, event.log.transactionHash);

    await saveTx({
      user: to.toLowerCase(),
      amount: ethers.formatUnits(amount, 18),
      type: "deposit",
      chain: "BNB",
      status: "completed",
      hash: event.log.transactionHash
    });
  });
}

// WAIT FOR 6 CONFIRMATIONS
async function waitConfirmations(provider, txHash) {
  let confirmed = false;

  while (!confirmed) {
    const tx = await provider.getTransactionReceipt(txHash);

    if (tx && tx.confirmations >= 6) {
      confirmed = true;
    } else {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

module.exports = {
  listenETHDeposits,
  listenBNBDeposits
};
