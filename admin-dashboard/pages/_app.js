import '../styles/globals.css';
import { ToastProvider } from '../utils/toast';

export default function App({ Component, pageProps }) {
  return <ToastProvider><Component {...pageProps} /></ToastProvider>;
}