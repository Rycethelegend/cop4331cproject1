const fs = require('fs');
const path = require('path');

function createCodeHarness(mockOverrides = {}) {
  const codePath = path.resolve(__dirname, '../js/code.js');
  const source = fs.readFileSync(codePath, 'utf8');

  const env = {
    document: {
      cookie: '',
      getElementById: jest.fn(() => ({ value: '', innerHTML: '' })),
      getElementsByTagName: jest.fn(() => [{ innerHTML: '' }]),
    },
    window: {
      location: { href: '' },
    },
    md5: jest.fn((val) => `hashed_${val}`),
    XMLHttpRequest: jest.fn(),
    ...mockOverrides,
  };

  // Wrap js/code.js in a function so top-level `let` variables (userId, firstName, lastName)
  // are scoped to this instance and can be read/mutated via helpers without vm lexical quirks.
  const wrappedSource = `
    (function(document, window, md5, XMLHttpRequest) {
      ${source}
      return {
        getState: () => ({ userId, firstName, lastName }),
        setUserId: (val) => { userId = val; },
        doLogin,
        saveCookie,
        readCookie,
        doLogout,
        addColor,
        searchColor,
      };
    })
  `;

  const factory = eval(wrappedSource); // eslint-disable-line no-eval
  return factory(env.document, env.window, env.md5, env.XMLHttpRequest);
}

describe('Front-end unit tests for js/code.js', () => {
  test('readCookie parses valid userId, firstName, and lastName', () => {
    const doc = { cookie: 'firstName=Ada,lastName=Lovelace,userId=42' };
    const win = { location: { href: 'color.html' } };
    const app = createCodeHarness({ document: doc, window: win });

    app.readCookie();

    expect(app.getState()).toEqual({
      userId: 42,
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(win.location.href).toBe('color.html');
  });

  test('readCookie redirects to index.html when userId is missing or invalid', () => {
    const doc = { cookie: '' };
    const win = { location: { href: 'color.html' } };
    const app = createCodeHarness({ document: doc, window: win });

    app.readCookie();

    expect(app.getState().userId).toBe(-1);
    expect(win.location.href).toBe('index.html');
  });

  test('addColor sends JSON payload with color and userId to AddColor.php', () => {
    const openMock = jest.fn();
    const setRequestHeaderMock = jest.fn();
    const sendMock = jest.fn();

    class MockXHR {
      constructor() {
        this.readyState = 0;
        this.status = 200;
        this.responseText = '{"error":""}';
      }
      open(...args) {
        openMock(...args);
      }
      setRequestHeader(...args) {
        setRequestHeaderMock(...args);
      }
      send(...args) {
        sendMock(...args);
      }
    }

    const doc = {
      getElementById: jest.fn((id) => {
        if (id === 'colorText') return { value: 'Coral Reef', innerHTML: '' };
        if (id === 'colorAddResult') return { value: '', innerHTML: '' };
        return { value: '', innerHTML: '' };
      }),
    };

    const app = createCodeHarness({ document: doc, XMLHttpRequest: MockXHR });
    app.setUserId(7);
    app.addColor();

    expect(openMock).toHaveBeenCalledWith('POST', '/LAMPAPI/AddColor.php', true);
    expect(setRequestHeaderMock).toHaveBeenCalledWith(
      'Content-type',
      'application/json; charset=UTF-8'
    );
    expect(sendMock).toHaveBeenCalledWith(
      JSON.stringify({ color: 'Coral Reef', userId: 7 })
    );
  });
});