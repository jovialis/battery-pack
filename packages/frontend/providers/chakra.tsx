/**
 * Created by jovialis (Dylan Hanson) on 9/4/22.
 */

import {ChakraProvider as Provider, extendTheme} from '@chakra-ui/react'
import {ReactNode} from "react";

const theme = extendTheme({})

export const ChakraProvider = (props: {
	children: ReactNode
}) => {
	return <Provider theme={theme} {...props}/>
};
