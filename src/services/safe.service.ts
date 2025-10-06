import { ethers } from 'ethers';
import { SafeTransaction, SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import { SafeServiceError } from '../errors/safe.service.error.js';

export class SafeService {
  private safeSdk: any;

  constructor(private signer: ethers.Signer, private safeAddress: string) {}

  public async init(): Promise<void> {
    try {
      const { default: SafeSDK } = await import('@safe-global/protocol-kit');
      this.safeSdk = await (SafeSDK as any).init({
        provider: this.signer.provider!,
        signer: await this.signer.getAddress(),
        safeAddress: this.safeAddress
      });
    } catch (error) {
      throw new SafeServiceError('Failed to initialize Safe Service');
    }
  }

  public async createMultiSendTransaction(recipients: Array<{ to: string; value: string }>): Promise<SafeTransaction> {
    try {
      const transactions: SafeTransactionDataPartial[] = recipients.map(recipient => ({
        to: recipient.to,
        value: ethers.parseUnits(recipient.value, 'ether').toString(),
        data: '0x'
      }));
      return await this.safeSdk.createTransaction({ safeTransactionData: transactions });
    } catch (error) {
      throw new SafeServiceError('Failed to create multisend transaction');
    }
  }

  public async signTransaction(transaction: SafeTransaction): Promise<string> {
    try {
      const signedTransaction = await this.safeSdk.signTransaction(transaction);
      return signedTransaction.signatures.get(await this.signer.getAddress())?.data;
    } catch (error) {
      throw new SafeServiceError('Failed to sign transaction');
    }
  }

  public async executeTransaction(transaction: SafeTransaction): Promise<void> {
    try {
      await this.safeSdk.executeTransaction(transaction);
    } catch (error) {
      throw new SafeServiceError('Failed to execute transaction');
    }
  }

  public async getThreshold(): Promise<number> {
    try {
      return await this.safeSdk.getThreshold();
    } catch (error) {
      throw new SafeServiceError('Failed to get threshold');
    }
  }
}
