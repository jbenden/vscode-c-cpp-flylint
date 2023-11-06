/*
 * SPDX-FileCopyrightText: The Microsoft Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/* istanbul ignore file */

process.env.NODE_ENV = 'test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock('vscode', () => (global as any).vscode, { virtual: true });
