import { MangoUtils } from "./mango_utils";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { sleep } from "@blockworks-foundation/mango-client";
import * as fs from 'fs';
import { web3 } from "@project-serum/anchor";

export async function main() {
    const connection = new Connection('http://localhost:8899', 'confirmed');
    console.log('Connecting to cluster')
    const authority = Keypair.generate();


    console.log('Configuring authority')
    const blockHash = await connection.getRecentBlockhash('confirmed');
    const blockHeight = await connection.getBlockHeight('confirmed');
    const signature =  await connection.requestAirdrop(authority.publicKey, LAMPORTS_PER_SOL * 1000);
    await connection.confirmTransaction(signature, 'confirmed');
    const beginSlot = await connection.getSlot();
    console.log('Creating Mango Cookie')
    const mangoProgramId = new PublicKey('BXhdkETgbHrr5QmVBT1xbz3JrMM28u5djbVtmTUfmFTH')
    const dexProgramId = new PublicKey('3qx9WcNPw4jj3v1kJbWoxSN2ZAakwUXFu9HDr2QjQ6xq');

    const logId = connection.onLogs(mangoProgramId, (log, ctx) => {
        if (log.err != null ){
            console.log("mango error : " + log.err.toString())
        }
        else {
            for(const l of log.logs) {
                console.log("mango log : " + l)
            }
        }
    });

    try{
        const mangoUtils = new MangoUtils(connection, authority, mangoProgramId, dexProgramId);

        const cookie = await mangoUtils.createMangoCookie(['MNGO', 'SOL', 'BTC', 'ETH', 'AVAX', 'SRM', 'FTT', 'RAY', 'MNGO', 'BNB', 'GMT', 'ADA'])
        
        console.log('Creating ids.json');
        const json =  mangoUtils.convertCookie2Json(cookie)
        fs.writeFileSync('ids.json', JSON.stringify(json, null, 2));
        fs.writeFileSync('authority.json', '[' + authority.secretKey.toString() + ']');
        console.log('Mango cookie created successfully')

        const nbUsers = 50;
        console.log('Creating ' + nbUsers +' Users');
        const users = (await mangoUtils.createAndMintUsers(cookie, 50)).map(x => {
            const info = {};
            info['publicKey'] = x.kp.publicKey.toBase58();
            info['secretKey'] = Array.from(x.kp.secretKey);
            info['mangoAccountPks'] = [x.mangoAddress.toBase58()];
            return info;
        })
        console.log('created ' + nbUsers +' Users');
        fs.writeFileSync('accounts-20.json', JSON.stringify(users));

    } finally {
        // to log mango logs
        await sleep(5000)
        const endSlot = await connection.getSlot();
        const blockSlots = await connection.getBlocks(beginSlot, endSlot);
        console.log("\n\n===============================================")
        for (let blockSlot of blockSlots) {
            const block = await connection.getBlock(blockSlot);
            for (let i =0; i<block.transactions.length; ++i){
                if(block.transactions[i].meta.logMessages)
                {
                    for(const msg of block.transactions[i].meta.logMessages)
                    {
                        console.log('solana_message : ' + msg);
                    }
                }
            }
        }

        connection.removeOnLogsListener(logId);
    }    
} 

main().then(x=> {
    console.log('finished sucessfully')
}).catch(e => {
    console.log('caught an error : ' + e)
})
