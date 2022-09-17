import type {AppProps} from 'next/app'
import {ApolloProvider} from "../providers/apollo";
import {ChakraProvider} from "../providers/chakra";

function App({Component, pageProps}: AppProps) {
	return <>
		<ApolloProvider>
			<ChakraProvider>
				<Component {...pageProps} />
			</ChakraProvider>
		</ApolloProvider>
	</>
}

export default App
