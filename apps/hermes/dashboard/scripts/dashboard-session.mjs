export const loginToDashboard = async ({ baseUrl, email, password }) => {
  const response = await fetch(`${baseUrl}/login/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed with HTTP ${response.status}`);
  }
  const cookiePairs = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0]);
  const cookies = cookiePairs.map((pair) => {
    const separatorIndex = pair.indexOf("=");

    return {
      name: pair.slice(0, separatorIndex),
      value: pair.slice(separatorIndex + 1),
    };
  });

  return { cookieHeader: cookiePairs.join("; "), cookies };
};
