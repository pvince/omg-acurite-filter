/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StatusCodes } from 'http-status-codes';
import {
  buildError,
  buildSuccess,
  isError,
  isSuccess,
  translateError
} from './apiError';

describe('apiError', () => {
  it('should build a success status', () => {
    const result = buildSuccess();

    expect(result.code).to.equal(StatusCodes.OK);
    expect(result.message).to.equal('Ok');
    expect(isSuccess(result)).to.be.true;
    expect(isError(result)).to.be.false;
  });

  it('should build an error status with default code', () => {
    const result = buildError('oops');

    expect(result.code).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(result.message).to.equal('oops');
    expect(isSuccess(result)).to.be.false;
    expect(isError(result)).to.be.true;
  });

  it('should build an error status with a custom code', () => {
    const result = buildError('invalid', StatusCodes.BAD_REQUEST);

    expect(result.code).to.equal(StatusCodes.BAD_REQUEST);
    expect(result.message).to.equal('invalid');
  });

  it('should translate Error to message text', () => {
    const result = translateError(new Error('boom'), StatusCodes.CONFLICT);

    expect(result.code).to.equal(StatusCodes.CONFLICT);
    expect(result.message).to.equal('boom');
  });

  it('should translate non-Error values to string', () => {
    const result = translateError(42, StatusCodes.BAD_GATEWAY);

    expect(result.code).to.equal(StatusCodes.BAD_GATEWAY);
    expect(result.message).to.equal('42');
  });
});
