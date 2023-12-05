import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import expressAsyncHandler from 'express-async-handler';
import dataStore from '../services/database/dataStore';
import { IDataStoreOMGMsg } from '../services/database/dataStore.types';
import _ from 'lodash';
import { ParsedQs } from 'qs';
import { buildError, buildSuccess, isError, isSuccess } from './apiError';


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

  let status = buildSuccess();

  const device_id = req.params.device_id ?? null;
  const max_age = parseNum(req.query.max_age);
  const min_age = parseNum(req.query.min_age);

  let result: IDataStoreOMGMsg[] | null = null;
  if (max_age && min_age && max_age < min_age) {
    status = buildError('max_age must be greater than min_age', StatusCodes.BAD_REQUEST);
  } else if (device_id === null) {
    status = buildError('device_id is required.', StatusCodes.BAD_REQUEST);
  } else {
    result = await dataStore.getByDeviceID(device_id, max_age, min_age);
  }

  if (isSuccess(status) && result === null) {
    status = buildError(`Device with id ${device_id} not found.`, StatusCodes.NOT_FOUND);
  } else {
    res.json(result);
  }

  if (isError(status)) {
    res.json(status);
    res.statusCode = status.code;
  }
}


const dataRouter = Router();

dataRouter.get('/v1/data/msgs/:device_id', expressAsyncHandler(handleMsgsByDeviceID));

export default dataRouter;
