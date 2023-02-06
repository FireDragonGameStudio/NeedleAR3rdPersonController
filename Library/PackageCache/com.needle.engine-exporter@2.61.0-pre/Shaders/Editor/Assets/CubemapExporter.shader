// Unity built-in shader source. Copyright (c) 2016 Unity Technologies. MIT license (see license.txt)

Shader "Skybox/Cubemap Exporter"
{
	Properties
	{
		_Tex ("Cubemap   (HDR)", Cube) = "grey" {}
	}

	SubShader
	{
		Tags
		{
			"Queue"="Geometry"
		}
		Cull Off ZWrite Off

		Pass
		{
			CGPROGRAM
			#pragma vertex vert
			#pragma fragment frag
			#pragma target 2.0

			#include "UnityCG.cginc"

			samplerCUBE _Tex;
			half4 _Tex_HDR;
			float4x4 _exporter_matrix;

			struct appdata_t
			{
				float4 vertex : POSITION;
			};

			struct v2f
			{
				float4 vertex : SV_POSITION;
				float3 texcoord : TEXCOORD0;
			};

			v2f vert(appdata_t v)
			{
				v2f o;
				// o.vertex = UnityObjectToClipPos(v.vertex);
				// Workaround for what seems to be a Unity timing/rendering calls bug: depending on where the export was triggered from, model matrices are sometimes incorrect.
				// So for this particular case, we're pre-calculating in C# land and pass the result matrix in here.

				// TODO this isn't working in URP for some reason
				o.vertex = mul(_exporter_matrix, float4(v.vertex.xyz * 1, 1.0));
				o.texcoord = v.vertex.xyz;
				return o;
			}

			fixed4 frag(v2f i) : SV_Target
			{
				half4 tex = texCUBE(_Tex, i.texcoord);
				half3 c = DecodeHDR(tex, _Tex_HDR);
				return half4(c, 1);
			}
			ENDCG
		}
	}


	Fallback Off

}