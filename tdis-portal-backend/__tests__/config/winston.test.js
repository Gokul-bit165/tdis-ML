describe('config/winston', () => {
    describe('structureBaseLogObject', () => {
        it('returns location, url, and pid', () => {
            const { structureBaseLogObject } = require('../../config/winston');
            expect(structureBaseLogObject('loc', '/path', 42)).toEqual({
                location: 'loc',
                url: '/path',
                pid: 42,
            });
        });
    });

    describe('errorWithDebug', () => {
        it('enriches log object and writes to error and debug loggers', async () => {
            jest.resetModules();
            process.env.NODE_ENV = 'test';
            const winston = require('../../config/winston');
            const err = new Error('boom');
            err.name = 'ErrName';
            const spyError = jest.spyOn(winston.logger, 'error').mockImplementation(() => {});
            const spyDebug = jest.spyOn(winston.debugLogger, 'debug').mockImplementation(() => {});
            await winston.logger.errorWithDebug('msg', err, { key: 1 });
            expect(spyError).toHaveBeenCalledWith(
                'msg',
                expect.objectContaining({
                    key: 1,
                    error: 'ErrName: boom',
                }),
            );
            expect(spyDebug).toHaveBeenCalledWith(err.stack);
            spyError.mockRestore();
            spyDebug.mockRestore();
        });
    });

    describe('NODE_ENV-specific configuration', () => {
        const original = process.env.NODE_ENV;

        afterEach(() => {
            process.env.NODE_ENV = original;
            jest.resetModules();
        });

        it('loads when NODE_ENV is development', () => {
            process.env.NODE_ENV = 'development';
            expect(() => require('../../config/winston')).not.toThrow();
        });

        it('loads when NODE_ENV is production', () => {
            process.env.NODE_ENV = 'production';
            expect(() => require('../../config/winston')).not.toThrow();
        });
    });
});
