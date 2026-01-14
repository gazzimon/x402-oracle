import { ResourceContainer } from './containers/ResourceContainer';
import { GlobalStyle } from './styles';

const API_BASE = import.meta.env.VITE_API_BASE as string;

export default function App(): JSX.Element {
  return (
    <>
      <GlobalStyle />
      <ResourceContainer apiBase={API_BASE} />
    </>
  );
}
