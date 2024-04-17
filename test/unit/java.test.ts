/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2024 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { scan } from '../../src/scan';
import * as java from '../../src/java';
import * as logging from '../../src/logging';
import { ServerMock } from './mocks/ServerMock';
import { fetchServerVersion } from '../../src/java';

const serverHandler = new ServerMock();

beforeEach(() => {
  serverHandler.reset();
});

describe('java', () => {
  it('the SonarQube version should be fetched correctly', async () => {
    serverHandler.mockServerVersionResponse('3.2.1.12313');

    const serverSemver = await fetchServerVersion('http://sonarqube.com', 'dummy-token');
    expect(serverSemver).toEqual('3.2.1.12313');
  });
});
