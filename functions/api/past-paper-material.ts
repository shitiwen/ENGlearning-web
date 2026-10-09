import { pastPaperMaterial } from '../../server/pastPaperMaterial'
export const onRequestGet = ({ request }:{request:Request}) => pastPaperMaterial(request)
