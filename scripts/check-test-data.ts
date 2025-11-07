/**
 * Script to check existing test data and create mock data if needed
 */
import { config as dotenv_config } from 'dotenv';
import mysql from 'mysql2/promise';

dotenv_config();

interface TestDataResult {
    hasData: boolean;
    testOrgId?: string;
    testRoundId?: string;
    orgName?: string;
    roundNumber?: number;
    error?: string;
}

async function createConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_UNAME,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });
}

async function checkTestData(): Promise<TestDataResult> {
    let connection;
    try {
        connection = await createConnection();
        console.log('🔍 Checking existing test data...\n');

        // Check organizations with Safe configuration
        const [orgsWithSafe] = await connection.execute(`
            SELECT id, name, safeAddress, safeChainId, stablecoinAddress, recognitionTokenAddress 
            FROM organizations 
            WHERE safeAddress IS NOT NULL 
            LIMIT 5
        `) as any[];

        console.log(`📊 Organizations with Safe config: ${orgsWithSafe.length}`);
        if (orgsWithSafe.length > 0) {
            console.log('Sample organizations:');
            orgsWithSafe.forEach((org: any) => {
                console.log(`  - ${org.name} (${org.id})`);
                console.log(`    Safe: ${org.safeAddress} (Chain: ${org.safeChainId})`);
                console.log(`    Stablecoin: ${org.stablecoinAddress || 'Not configured'}`);
            });
        }

        // Check completed rounds without payouts
        const [incompleteRounds] = await connection.execute(`
            SELECT r.id, r.roundNumber, r.isCompleted, r.txHash, o.name as orgName
            FROM rounds r
            JOIN organizations o ON r.organization_id = o.id
            WHERE r.isCompleted = true AND r.txHash IS NULL
            LIMIT 5
        `) as any[];

        console.log(`\n🔄 Completed rounds without payouts: ${incompleteRounds.length}`);
        if (incompleteRounds.length > 0) {
            console.log('Sample rounds:');
            incompleteRounds.forEach((round: any) => {
                console.log(`  - Round ${round.roundNumber} (${round.id}) - ${round.orgName}`);
            });
        }

        // Check compensation data
        const [compensationData] = await connection.execute(`
            SELECT COUNT(*) as count, r.id as roundId, r.roundNumber
            FROM contributor_round_compensations crc
            JOIN rounds r ON crc.round_id = r.id
            WHERE r.isCompleted = true AND r.txHash IS NULL
            GROUP BY r.id, r.roundNumber
            LIMIT 5
        `) as any[];

        console.log(`\n💰 Rounds with compensation data: ${compensationData.length}`);
        if (compensationData.length > 0) {
            console.log('Sample compensation data:');
            compensationData.forEach((comp: any) => {
                console.log(`  - Round ${comp.roundNumber}: ${comp.count} contributors`);
            });
        }

        // Check users with wallet addresses
        const [usersWithWallets] = await connection.execute(`
            SELECT COUNT(*) as count FROM users WHERE walletAddress IS NOT NULL
        `) as any[];

        console.log(`\n👥 Users with wallet addresses: ${usersWithWallets[0].count}`);

        // Summary
        console.log('\n📋 Test Data Summary:');
        console.log(`✅ Organizations with Safe: ${orgsWithSafe.length > 0 ? 'YES' : 'NO'}`);
        console.log(`✅ Rounds ready for payout: ${incompleteRounds.length > 0 ? 'YES' : 'NO'}`);
        console.log(`✅ Compensation data: ${compensationData.length > 0 ? 'YES' : 'NO'}`);
        console.log(`✅ Users with wallets: ${usersWithWallets[0].count > 0 ? 'YES' : 'NO'}`);

        const hasTestData = orgsWithSafe.length > 0 && incompleteRounds.length > 0 && 
                           compensationData.length > 0 && usersWithWallets[0].count > 0;

        if (hasTestData) {
            console.log('\n🎉 Sufficient test data exists! Ready to proceed with implementation.');
            
            return {
                hasData: true,
                testOrgId: orgsWithSafe[0].id,
                testRoundId: incompleteRounds[0].id,
                orgName: orgsWithSafe[0].name,
                roundNumber: incompleteRounds[0].roundNumber
            };
        } else {
            console.log('\n⚠️  Insufficient test data. Mock data creation needed.');
            return { hasData: false };
        }

    } catch (error: any) {
        console.error('❌ Error checking test data:', error.message);
        return { hasData: false, error: error.message };
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the check
checkTestData().then(result => {
    if (result.hasData) {
        console.log('\n🚀 Test Data Available:');
        console.log(`   Organization ID: ${result.testOrgId}`);
        console.log(`   Round ID: ${result.testRoundId}`);
        console.log(`   Test URLs:`);
        console.log(`   GET /api/v1/payouts/rounds?orgId=${result.testOrgId}`);
        console.log(`   GET /api/v1/payouts/preview?roundId=${result.testRoundId}`);
    } else {
        console.log('\n📝 Next Step: Create mock data');
    }
}).catch(console.error);
