import { Server } from './Server';
import { SSH } from './SSH';

export class Diagnostics {
  public checks: { message: string; status: boolean | null; fn: () => Promise<boolean> }[];

  private server!: Server;

  constructor() {
    this.checks = [
      {
        message: 'Checking SSH Connection to Cloud Machine',
        status: null,
        fn: this.hasSSHConnection,
      },
      { message: 'Checking Account Address', status: null, fn: this.hasAccountAddress },
    ];
  }

  public async run() {
    const connection = await SSH.getConnection();
    this.server = new Server(connection);
  }

  public async hasSSHConnection() {
    return await this.server.isConnected();
  }
}
