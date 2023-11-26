import { Request, Response, Router } from 'express';
import dataCache from '../services/dataCache';
import { StatusCodes } from 'http-status-codes';
import { DataEntry } from '../services/dataEntries/dataEntry';

/**
 * Summary of the data cache.
 */
interface IAPICacheSummaryItem {
  /**
   * Job ID, aka device ID
   */
  id: string;
  /**
   * Count of data entries for this device ID
   */
  count: number;

  /**
   * Timestamp for the most recently received data entry.
   */
  timestamps: {
    /**
     * Oldest cached data for this entry
     */
    oldest: Date;
    /**
     * Most recently cached data for this entry.
     */
    newest: Date;
  } | null;
}

/**
 * Build up the data we are going to return for the REST API for the /data API endpoint
 * @returns - Array that is a summary of all the data held in cache.
 */
function gatherDataCacheItems(): IAPICacheSummaryItem[] {
  const result: IAPICacheSummaryItem[] = [];
  for (const [device_id, dataEntryArray] of dataCache.getEntries()) {
    const oldest: Date | null =  dataEntryArray[0]?.timestamp ?? null;
    const newest: Date | null = dataEntryArray[dataEntryArray.length - 1]?.timestamp ?? null;

    result.push({
      id: device_id,
      count: dataEntryArray.length,
      timestamps: { oldest, newest }
    });
  }
  result.sort((itemA: IAPICacheSummaryItem, itemB: IAPICacheSummaryItem) => {
    const timestampA = itemA.timestamps?.oldest ?? new Date(0);
    const timestampB = itemB.timestamps?.oldest ?? new Date(0);
    return timestampA.getTime() - timestampB.getTime();
  });
  return result;
}

/**
 * Returns the list of jobs .
 * @param req - Incoming Request
 * @param res - Outgoing response
 */
function handleData(req: Request, res: Response): void {
  res.json(gatherDataCacheItems());
  res.send();
}

/**
 * Get a specific data entry from cache.
 * @param req - Incoming request.
 * @param res - Outgoing response.
 */
function handleDataEntry(req: Request, res: Response): void {
  const id = req.params.id ?? null;
  let entries: DataEntry[] | null = null;
  if (id !== null) {
    entries = dataCache.getByID(id);
  }
  if (entries !== null) {
    res.json(entries);
  } else {
    res.sendStatus(StatusCodes.NOT_FOUND);
  }
}

const dataRouter = Router();

dataRouter.get('/v1/data', handleData);
dataRouter.get('/v1/data/:id', handleDataEntry);
export default dataRouter;
