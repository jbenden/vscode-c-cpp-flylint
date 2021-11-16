import * as fs from 'fs';
import { injectMockFileSystem } from '../mock-fs';

const SUBJECT: string = '.gitignore';
const EXPECTED: string = 'git ignore content';

describe('mock file-system', () => {
    injectMockFileSystem();

    test('has specific file on disk', () => {
        const data = fs.statSync(SUBJECT);

        expect(data.isFile()).toBeTruthy();
    });

    test('has known content in specific file', () => {
        const data = fs.readFileSync(SUBJECT, 'utf8');

        expect(data).toBe(EXPECTED);
    });
});

describe('real file-system', () => {
    test('has specific file on disk', () => {
        const data = fs.statSync(SUBJECT);

        expect(data.isFile()).toBeTruthy();
    });

    test('has unknown content in specific file', () => {
        const data = fs.readFileSync(SUBJECT, 'utf8');

        expect(data).not.toBe(EXPECTED);
    });
});
