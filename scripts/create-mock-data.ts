/**
 * Create mock test data for Module II implementation
 * This will be removed once real data is available
 */

interface MockOrganization {
    id: string;
    name: string;
    safeAddress: string;
    safeChainId: number;
    stablecoinAddress: string;
    stablecoinDecimals: number;
    recognitionTokenAddress: string;
    recognitionTokenDecimals: number;
    recognitionTokenMode: string;
}

interface MockRound {
    id: string;
    roundNumber: number;
    isCompleted: boolean;
    txHash: string | null;
    organizationId: string;
    startDate: string;
    endDate: string;
    compensationCycleStartDate: string;
    compensationCycleEndDate: string;
}

interface MockContributor {
    id: string;
    walletAddress: string;
    name: string;
    fiat: number;
    tp: number;
    culturalScore: number;
    workScore: number;
}

interface MockData {
    organization: MockOrganization;
    round: MockRound;
    contributors: MockContributor[];
}

const mockData: MockData = {
    // Mock organization with Safe configuration (from Module A)
    organization: {
        id: 'mock-org-123',
        name: 'Test Organization',
        safeAddress: '0x1234567890123456789012345678901234567890',
        safeChainId: 421614, // Arbitrum Sepolia
        stablecoinAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        stablecoinDecimals: 6,
        recognitionTokenAddress: '0xfedcbafedcbafedcbafedcbafedcbafedcbafedcba',
        recognitionTokenDecimals: 18,
        recognitionTokenMode: 'MINT'
    },

    // Mock completed round without payout
    round: {
        id: 'mock-round-456',
        roundNumber: 5,
        isCompleted: true,
        txHash: null, // No payout yet
        organizationId: 'mock-org-123',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        compensationCycleStartDate: '2024-01-01',
        compensationCycleEndDate: '2024-01-31'
    },

    // Mock contributors with compensation data
    contributors: [
        {
            id: 'user-1',
            walletAddress: '0x1111111111111111111111111111111111111111',
            name: 'Alice Developer',
            fiat: 1500.00,
            tp: 500,
            culturalScore: 4.2,
            workScore: 4.5
        },
        {
            id: 'user-2', 
            walletAddress: '0x2222222222222222222222222222222222222222',
            name: 'Bob Designer',
            fiat: 1200.00,
            tp: 800,
            culturalScore: 4.0,
            workScore: 4.1
        },
        {
            id: 'user-3',
            walletAddress: '0x3333333333333333333333333333333333333333', 
            name: 'Carol Manager',
            fiat: 2000.00,
            tp: 300,
            culturalScore: 4.8,
            workScore: 4.3
        }
    ]
};

console.log('📝 Mock Test Data Created for Module II Implementation\n');

console.log('🏢 Mock Organization:');
console.log(`   ID: ${mockData.organization.id}`);
console.log(`   Name: ${mockData.organization.name}`);
console.log(`   Safe: ${mockData.organization.safeAddress} (Chain: ${mockData.organization.safeChainId})`);
console.log(`   Stablecoin: ${mockData.organization.stablecoinAddress} (${mockData.organization.stablecoinDecimals} decimals)`);
console.log(`   Recognition Token: ${mockData.organization.recognitionTokenAddress} (${mockData.organization.recognitionTokenDecimals} decimals)`);

console.log('\n🔄 Mock Round:');
console.log(`   ID: ${mockData.round.id}`);
console.log(`   Round Number: ${mockData.round.roundNumber}`);
console.log(`   Status: Completed, No Payout Yet`);

console.log('\n👥 Mock Contributors:');
mockData.contributors.forEach(contributor => {
    console.log(`   - ${contributor.name} (${contributor.id})`);
    console.log(`     Wallet: ${contributor.walletAddress}`);
    console.log(`     Fiat: $${contributor.fiat}, TP: ${contributor.tp}`);
    console.log(`     Scores: Cultural ${contributor.culturalScore}, Work ${contributor.workScore}`);
});

const totalFiat = mockData.contributors.reduce((sum, c) => sum + c.fiat, 0);
const totalTP = mockData.contributors.reduce((sum, c) => sum + c.tp, 0);

console.log('\n💰 Totals:');
console.log(`   Total Fiat Payout: $${totalFiat}`);
console.log(`   Total TP Payout: ${totalTP}`);
console.log(`   Recipients: ${mockData.contributors.length}`);

console.log('\n🧪 Test URLs (once API is implemented):');
console.log(`   GET /api/v1/payouts/rounds?orgId=${mockData.organization.id}`);
console.log(`   GET /api/v1/payouts/preview?roundId=${mockData.round.id}`);
console.log(`   POST /api/v1/payouts/propose { "roundId": "${mockData.round.id}", "tokenType": "STABLECOIN" }`);
console.log(`   POST /api/v1/payouts/propose { "roundId": "${mockData.round.id}", "tokenType": "RECOGNITION" }`);
console.log(`   GET /api/v1/payouts/status?roundId=${mockData.round.id}`);

console.log('\n⚠️  Note: This mock data will be replaced with real database data once available.');
console.log('🗑️  Mock data removal: After successful testing with real data');

// Export for use in tests
export default mockData;
