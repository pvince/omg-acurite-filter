import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import expressAsyncHandler from 'express-async-handler';
import dataStore from '../services/database/dataStore';
import { IDataStoreOMGMsg } from '../services/database/dataStore.types';
import _ from 'lodash';
import { buildError, buildSuccess, isError, isSuccess } from './apiError';


/**
 * Retrieves mqtt messages for a specific device from the database.
 * @param req - Incoming request.
 * @param res - Outgoing response.
 */
async function handleMsgsByDeviceID(req: Request, res: Response): Promise<void> {
  const parseNum = function (input: unknown): number | undefined  {
    let result: number | undefined = undefined;

    if (_.isString(input)) {
      result = _.parseInt(input);
    } else if (Array.isArray(input) && input.length > 0 && _.isString(input[0])) {
      result = _.parseInt(input[0]);
    }
    return result;
  };

  let status = buildSuccess();

  const rawDeviceID = req.params.device_id;
  const device_id = typeof rawDeviceID === 'string' ? rawDeviceID : null;
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
    res.statusCode = status.code;
    res.json(status);
  }
}

export { handleMsgsByDeviceID };


const dataRouter = Router();

dataRouter.get('/v1/data/msgs/:device_id', expressAsyncHandler(handleMsgsByDeviceID));

export default dataRouter;
