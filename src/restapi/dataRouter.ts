import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import expressAsyncHandler from 'express-async-handler';
import dataStore from '../services/database/dataStore';
import { IDataStoreOMGMsg } from '../services/database/dataStore.util';
import _ from 'lodash';
import { ParsedQs } from 'qs';



/**
 * Retrieves mqtt messages for a specific device from the database.
 * @param req - Incoming request.
 * @param res - Outgoing response.
 */
async function handleMsgsByDeviceID(req: Request, res: Response): Promise<void> {
  const parseNum = function (input: undefined | string | string[] | ParsedQs | ParsedQs[]): number | undefined  {
    let result: number | undefined = undefined;

    if (_.isString(input)) {
      result = _.parseInt(input);
    }
    return result;
  };

  const device_id = req.params.device_id ?? null;
  const max_age = parseNum(req.query.max_age);
  const min_age = parseNum(req.query.min_age);

  let result: IDataStoreOMGMsg[] | null = null;
  if (device_id !== null) {
    result = await dataStore.getByDeviceID(device_id, max_age, min_age);
  }
  if (result !== null) {
    res.json(result);
  } else {
    res.sendStatus(StatusCodes.NOT_FOUND);
  }
}


const dataRouter = Router();

dataRouter.get('/v1/data/msgs/:device_id', expressAsyncHandler(handleMsgsByDeviceID));

export default dataRouter;
