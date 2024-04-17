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

import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { getHttpAgents } from '../../src/http-agent';

describe('http-agent', () => {
  it('should define proxy url correctly', () => {
    const proxyUrl = new URL('http://proxy.com');

    const agents = getHttpAgents(proxyUrl);
    expect(agents.httpAgent).toBeInstanceOf(HttpProxyAgent);
    expect(agents.httpAgent?.proxy.toString()).toBe(proxyUrl.toString());
    expect(agents.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
    expect(agents.httpsAgent?.proxy.toString()).toBe(proxyUrl.toString());
  });

  it('should not define agents when no proxy is provided', () => {
    const agents = getHttpAgents();
    expect(agents.httpAgent).toBeUndefined();
    expect(agents.httpsAgent).toBeUndefined();
    expect(agents).toEqual({});
  });
});
