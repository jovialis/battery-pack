/**
 * Created by jovialis (Dylan Hanson) on 9/3/22.
 */

import {ApolloClient, ApolloProvider as Provider, InMemoryCache} from "@apollo/client";
import {createUploadLink} from "apollo-upload-client";
import {ReactNode} from "react";

const client = new ApolloClient({
	cache: new InMemoryCache(),
	credentials: "include",
	link: createUploadLink({
		credentials: 'include',
		uri: process.env.NEXT_PUBLIC_API_URL + '/graphql',
		headers: {
			"Apollo-Require-Preflight": "true"
		}
	})
});

export const ApolloProvider = (props: {
	children: ReactNode
}) => {
	return <Provider client={client} {...props}/>
};
