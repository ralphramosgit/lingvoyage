import * as WebBrowser from 'expo-web-browser';

/** Opens a fact's source page in the in-app browser. */
export function openSource(url: string) {
  void WebBrowser.openBrowserAsync(url);
}
