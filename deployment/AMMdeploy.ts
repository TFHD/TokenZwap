import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { network } from "hardhat";

const FEE_PERCENT = 2;
const INITIAL_SUPPLY = 1_000_000;

const DEPLOY_TOKENS = true;

const TOKEN_A_ADDRESS = process.env.TOKEN_A_ADDRESS;
const TOKEN_B_ADDRESS = process.env.TOKEN_B_ADDRESS;

async function deployToken(ethers: any, name: string, initialSupply: number) {
    const token = await ethers.deployContract(name, [initialSupply]);
    await token.waitForDeployment();
    return token;
}
async function main() {
    const { ethers } = await network.create("sepolia");

    let tokenA: any | undefined = undefined;
    let tokenB: any | undefined = undefined;
    if (DEPLOY_TOKENS) {
        tokenA = await deployToken(ethers, "SabarthoTokenA", INITIAL_SUPPLY);
        tokenB = await deployToken(ethers, "SabarthoTokenB", INITIAL_SUPPLY);
        console.log("Token A déployé à l'adresse :", await tokenA.getAddress());
        console.log("Token B déployé à l'adresse :", await tokenB.getAddress());
    }


    const AMM = await ethers.deployContract("AMSSabartho", [tokenA.getAddress() || TOKEN_A_ADDRESS, tokenB.getAddress() || TOKEN_B_ADDRESS, FEE_PERCENT]);
    await AMM.waitForDeployment();

    console.log("AMSSabartho déployé à l'adresse :", await AMM.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
