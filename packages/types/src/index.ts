export type RawShareMessage = {
  type: "share";
  replay?: boolean;
  share: {
    workinfoid: number;
    clientid: number;
    diff: number;
    sdiff: number;
    hash: string;
    result: boolean;
    errn: number;
    createdate: string;
    ts: number;
    workername: string;
    username: string;
    address: string;
    worker?: string;
    ip?: string;
    agent?: string;
    rejectReason?: string | null;
    round: string;
    file?: string;
  };
};

export type WorkerState = {
  workerName: string;
  displayName: string;
  bestSdiff: number;
  sharesCount: number;
  lastShareTs: number;
  size: number;
  round: string;
};