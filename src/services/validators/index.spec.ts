/* eslint-disable @typescript-eslint/no-magic-numbers,@typescript-eslint/no-unused-expressions */
import { get_lightning_data_entry } from './validateStrikeCount.spec';
import { initialize_validators, is_data_valid } from './index';

import { describe, it } from 'mocha';
import { expect } from 'chai';
import configuration from '../configuration';
import { VALID_RANGE } from './validateStrikeCount';

describe('is_data_valid', () => {
    describe('Acurite6045M Lightning Detector', () => {
        afterEach(() => {
            // Some validators cache values on the validator themselves.
            // Prevent test shine-through by wiping the validators between
            // tests.
            initialize_validators();
        });

        it('should detect bad temperature', () => {
            let strike_count = 142;
            let temperature_C = 6.777777778;
            const prev_values = [
                get_lightning_data_entry({ strike_count, temperature_C  })
            ];

            strike_count = 145;
            temperature_C = 40.44444444;
            const new_value = get_lightning_data_entry({ strike_count, temperature_C });

            const result = is_data_valid(prev_values, new_value);

            expect(result).to.be.false;
        });

        it('should detect bad humidity (too high)', () => {
            let strike_count = 142;
            let temperature_C = 6.777777778;
            let humidity = 42;
            const prev_values = [
                get_lightning_data_entry({ strike_count, temperature_C, humidity  })
            ];

            strike_count = 145;
            temperature_C = temperature_C + configuration.validTemperatureRange;
            humidity = humidity + configuration.validHumidityRange + 0.01;

            const new_value = get_lightning_data_entry({ strike_count, temperature_C, humidity });

            const result = is_data_valid(prev_values, new_value);

            expect(result).to.be.false;
        });

        it('should detect bad humidity (too low)', () => {
            let strike_count = 142;
            let temperature_C = 6.777777778;
            let humidity = 42;
            const prev_values = [
                get_lightning_data_entry({ strike_count, temperature_C, humidity  })
            ];

            strike_count = 145;
            temperature_C = temperature_C - configuration.validTemperatureRange;
            humidity = humidity - configuration.validHumidityRange - 0.01;

            const new_value = get_lightning_data_entry({ strike_count, temperature_C, humidity });

            const result = is_data_valid(prev_values, new_value);

            expect(result).to.be.false;
        });

        it('should detect bad lightning (decreasing)', () => {
            let strike_count = 142;
            let temperature_C = 6.777777778;
            const prev_values = [
                get_lightning_data_entry({ strike_count, temperature_C  })
            ];

            strike_count = strike_count - 1;
            temperature_C = temperature_C + configuration.validTemperatureRange;
            const new_value = get_lightning_data_entry({ strike_count, temperature_C });

            const result = is_data_valid(prev_values, new_value);

            expect(result).to.be.false;
        });

        it('should detect temporary bad lightning (increased)', () => {
            const strike_count = 142;
            const bad_strike_count = strike_count + 4;
            const val1 = get_lightning_data_entry({ strike_count: bad_strike_count });
            const val2 = get_lightning_data_entry({ strike_count });

            const prev_values = [
                get_lightning_data_entry({ strike_count  })
            ];

            // Prime the validator
            expect(is_data_valid(prev_values, val2)).to.be.true;

            // Send the bad value
            expect(is_data_valid(prev_values, val1)).to.be.false;

            // Watch it recover.
            expect(is_data_valid(prev_values, val2)).to.be.false;
            expect(is_data_valid(prev_values, val2)).to.be.true;
        });

        it('should detect temporary bad lightning (decreased)', () => {
            const strike_count = 142;
            const bad_strike_count = strike_count - 4;
            const val1 = get_lightning_data_entry({ strike_count: bad_strike_count });
            const val2 = get_lightning_data_entry({ strike_count });

            const prev_values = [
                get_lightning_data_entry({ strike_count  })
            ];

            // Prime the validator
            expect(is_data_valid(prev_values, val2)).to.be.true;

            // Send the bad value
            expect(is_data_valid(prev_values, val1)).to.be.false;

            // Watch it recover.
            expect(is_data_valid(prev_values, val2)).to.be.true;
        });

        it('should detect bad lightning (out of range)', () => {
            let strike_count = 142;
            let temperature_C = 6.777777778;
            const prev_values = [
                get_lightning_data_entry({ strike_count, temperature_C  })
            ];

            strike_count = strike_count + VALID_RANGE + 1;
            temperature_C = temperature_C + configuration.validTemperatureRange;
            const new_value = get_lightning_data_entry({ strike_count, temperature_C });

            const result = is_data_valid(prev_values, new_value);

            expect(result).to.be.false;
        });

        it('should detect a valid value (at max)', () => {
            let strike_count = 142;
            let temperature_C = 6.777777778;
            let humidity = 42;
            const prev_values = [
                get_lightning_data_entry({ strike_count, temperature_C, humidity  })
            ];

            strike_count = strike_count + VALID_RANGE;
            temperature_C = temperature_C + configuration.validTemperatureRange;
            humidity = humidity + configuration.validHumidityRange;

            const new_value = get_lightning_data_entry({ strike_count, temperature_C, humidity });

            const result = is_data_valid(prev_values, new_value);

            expect(result).to.be.true;
        });

        it('should detect a valid value (at min)', () => {
            const strike_count = 142;
            let temperature_C = 6.777777778;
            let humidity = 42;
            const prev_values = [
                get_lightning_data_entry({ strike_count, temperature_C, humidity  })
            ];

            temperature_C = temperature_C - configuration.validTemperatureRange;
            humidity = humidity - configuration.validHumidityRange;

            const new_value = get_lightning_data_entry({ strike_count, temperature_C, humidity });

            const result = is_data_valid(prev_values, new_value);

            expect(result).to.be.true;
        });
    });
});
