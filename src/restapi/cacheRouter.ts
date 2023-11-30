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
function handleCache(req: Request, res: Response): void {
  res.json(gatherDataCacheItems());
  res.send();
}

/**
 * Get a specific data entry from cache.
 * @param req - Incoming request.
 * @param res - Outgoing response.
 */
function handleCacheEntry(req: Request, res: Response): void {
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

/**
 * Scans the data cache and runs the 'purge stale entries' routine on each data set. Then it deletes any entries that
 * no longer have any cached data.
 * @param req - Incoming request
 * @param res - Outgoing response
 */
function handleCleanup(req: Request, res: Response): void {
  const results = {
    initialCount: dataCache.count,
    deleted: dataCache.cleanup(),
    finalCount: dataCache.count
  };

  res.json(results);
  res.send();
}

const cacheRouter = Router();

cacheRouter.get('/v1/cache', handleCache);
cacheRouter.get('/v1/cache/:id', handleCacheEntry);
cacheRouter.delete('/v1/cache/cleanup', handleCleanup);

export default cacheRouter;
