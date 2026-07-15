import { For } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import type { LayoutItem } from '@interfaces/application.interface';

import style from '@components/wb-layout-builder/wb-layout-builder.module.scss';

export default function(props: { layout: LayoutItem[] }): JSX.Element {
	return (
		<>
			<div class={`wb-layout-builder ${style['wb-layout-builder']}`}>
				<For each={props.layout}>
					{(item: LayoutItem, index: Accessor<number>): JSX.Element => {
						return (
							<>
								<div
									id={`layout-item-${index()}`}
									style={{
										width: item.size.width,
										height: item.size.height,
										left: item.position.x,
										top: item.position.y,
										background: item.style.accentColor,
										'z-index': item.style['z-index']
									}}
								>
									<h1>{item.label}</h1>
								</div>
							</>
						);
					}}
				</For>
			</div>
		</>
	);
}
