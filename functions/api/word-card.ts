import { handleAiRequest } from '../../server/deepseek'
import { aiEnvironment, type AiEnvironment } from '../../server/aiEnvironment'

type Context = { request:Request; env:AiEnvironment }
export const onRequestPost = ({ request, env }:Context) => handleAiRequest(request, aiEnvironment(env))
